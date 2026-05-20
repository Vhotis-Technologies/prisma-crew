/**
 * Image capture and upload helpers: camera/gallery, job photos, FormData prep.
 */
import * as ExpoImagePicker from "expo-image-picker";

/** Alert helpers used for permissions, errors, and multi-capture confirm. */
export type ImageAlertHelpers = {
  showAlert: (
    title: string,
    message: string,
    type?: "success" | "error" | "warning"
  ) => void;
  showConfirm: (title: string, message: string) => Promise<boolean>;
};

/** Convert a local image URI to a `File` for web-style uploads. */
const uriToFile = async (uri: string, filename: string): Promise<File> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
};

/** Launch camera, request permission, and process the captured image. */
const handleCameraSelection = async (
  alertHelpers?: ImageAlertHelpers
) => {
  try {
    const { status } = await ExpoImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      alertHelpers?.showAlert(
        "Permission needed",
        "Sorry, we need camera permissions to make this work!"
      );
      return;
    }

    let result = await ExpoImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      await handleImageSelection(imageUri);
    }
  } catch (error) {
    console.error("Error capturing image:", error);
    alertHelpers?.showAlert("Error", "Failed to capture image. Please try again.");
    throw error;
  }
};

/** Pick an image from the gallery after requesting media-library permission. */
const handleGallerySelection = async (
  alertHelpers?: ImageAlertHelpers
) => {
  try {
    const { status } =
      await ExpoImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      alertHelpers?.showAlert(
        "Permission needed",
        "Sorry, we need camera roll permissions to make this work!"
      );
      return;
    }

    let result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      await handleImageSelection(imageUri);
    }
  } catch (error) {
    console.error("Error selecting image:", error);
    alertHelpers?.showAlert("Error", "Failed to select image. Please try again.");
    throw error;
  }
};

/** Build serializable uri/filename metadata from a picked image URI. */
const handleImageSelection = async (imageUri: string) => {
  try {
    // Generate a filename based on timestamp
    const timestamp = Date.now();
    const filename = `vehicle_image_${timestamp}.jpg`;

    // Store only serializable data (uri and filename) in Redux state
    // File object will be created when needed for API calls
    const imageData = {
      uri: imageUri,
      filename: filename,
    };
  } catch (error) {
    console.error("Error processing image:", error);
  }
};

/** Capture a single job photo via camera only; returns null if cancelled. */
export const captureCameraOnlyImage = async (
  alertHelpers: ImageAlertHelpers
): Promise<{
  uri: string;
  type: string;
  filename: string;
} | null> => {
  try {
    const { status } = await ExpoImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      alertHelpers.showAlert(
        "Camera Permission Required",
        "Please allow camera access to capture before/after images of your work."
      );
      return null;
    }

    const result = await ExpoImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    const asset = result.assets[0];
    const timestamp = Date.now();
    const filename = `job_image_${timestamp}.jpg`;

    return {
      uri: asset.uri,
      type: "image/jpeg",
      filename: filename,
    };
  } catch (error) {
    console.error("Error capturing image:", error);
    alertHelpers.showAlert("Error", "Failed to capture image. Please try again.");
    return null;
  }
};

/** Capture up to `maxImages` job photos in sequence with confirm between shots. */
export const captureMultipleCameraImages = async (
  maxImages: number,
  alertHelpers: ImageAlertHelpers
): Promise<Array<{ uri: string; type: string; filename: string }>> => {
  const images: Array<{ uri: string; type: string; filename: string }> = [];

  for (let i = 0; i < maxImages; i++) {
    const shouldContinue =
      i === 0
        ? true
        : await alertHelpers.showConfirm(
            "Capture Another Image?",
            `You have captured ${i} image${i > 1 ? "s" : ""}. Please capture another image.`
          );

    if (!shouldContinue) break;

    const image = await captureCameraOnlyImage(alertHelpers);
    if (image) {
      images.push(image);
    } else {
      break;
    }
  }

  return images;
};

/** Build multipart FormData with job_id, segment, and indexed image parts. */
export const prepareImagesForUpload = (
  images: Array<{ uri: string; type: string; filename: string }>,
  jobId: string,
  segment: "interior" | "exterior" = "exterior"
): FormData => {
  const formData = new FormData();

  // Add job_id
  formData.append("job_id", jobId);

  // Add segment
  formData.append("segment", segment);

  // Add each image with indexed key
  images.forEach((image, index) => {
    formData.append(`image_${index}`, {
      uri: image.uri,
      type: image.type,
      name: image.filename,
    } as any);
  });

  return formData;
};

export {
  uriToFile,
  handleCameraSelection,
  handleGallerySelection,
  handleImageSelection,
};
