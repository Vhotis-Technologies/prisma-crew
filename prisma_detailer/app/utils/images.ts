import * as ExpoImagePicker from "expo-image-picker";

export type ImageAlertHelpers = {
  showAlert: (
    title: string,
    message: string,
    type?: "success" | "error" | "warning"
  ) => void;
  showConfirm: (title: string, message: string) => Promise<boolean>;
};

/**
 * Converts a local image URI to a File object for upload purposes.
 * This is necessary because the API expects File objects, but Expo ImagePicker returns URIs.
 *
 * @param {string} uri - The local URI of the image
 * @param {string} filename - The desired filename for the File object
 * @returns {Promise<File>} A Promise that resolves to a File object
 * @throws {Error} If the URI cannot be fetched or converted to a blob
 */
const uriToFile = async (uri: string, filename: string): Promise<File> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
};

/**
 * Handles camera image capture using Expo ImagePicker.
 * Requests camera permissions and launches the camera interface.
 * Processes the captured image through handleImageSelection and updates local state.
 *
 * @param alertHelpers - Optional alert helpers for showing permission/error messages
 */
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

/**
 * Handles image selection from the device's photo gallery.
 * Requests media library permissions and launches the image picker interface.
 *
 * @param alertHelpers - Optional alert helpers for showing permission/error messages
 */
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

/**
 * Processes a selected image by storing only serializable data in Redux state.
 * Creates a timestamped filename and stores the URI (for display) and filename (for upload).
 * File objects are created only when needed for API calls to avoid Redux serialization issues.
 *
 * @param {string} imageUri - The URI of the selected image
 * @throws {Error} If image processing fails
 */
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

/**
 * Captures an image using ONLY the camera (no gallery access).
 * Used for before/after job images where freshness is critical.
 *
 * @param alertHelpers - Alert helpers for permission/error messages (required for alerts)
 * @returns Image data or null if cancelled
 */
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

/**
 * Captures multiple images using ONLY the camera (no gallery access).
 * Allows capturing up to a specified number of images in sequence.
 *
 * @param maxImages - Maximum number of images to capture (default: 5)
 * @param alertHelpers - Alert helpers for "Capture another?" confirm and errors
 * @returns Array of captured images
 */
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
            `You have captured ${i} image${i > 1 ? "s" : ""}. Would you like to capture another?`
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

/**
 * Prepares image data for FormData upload to API.
 * Converts image data to the format expected by React Native's FormData.
 *
 * @param {Array<{ uri: string; type: string; filename: string }>} images - Array of image data
 * @param {string} jobId - The job ID
 * @param {string} segment - The segment type ('interior' or 'exterior')
 * @returns {FormData} FormData object ready for upload
 */
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
