/**
 * Auth slice: user session, tokens, sign-up draft, and authentication flags.
 */
import { createSlice } from "@reduxjs/toolkit";
import AuthState, { SignUpScreenProps } from "@/app/interfaces/AuthInterface";

const initialState: AuthState = {
  user: null,
  access: "",
  refresh: "",
  isAuthenticated: false,
  isLoading: false,
  signUpData: null,
  confirmPassword: "",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Set the authenticated detailer profile. */
    setUser: (state, action) => {
      state.user = action.payload;
    },
    /** Toggle global auth loading state. */
    setIsLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    /** Set whether the user is logged in. */
    setIsAuthenticated: (state, action) => {
      state.isAuthenticated = action.payload;
    },
    /** Store the JWT access token. */
    setAccessToken: (state, action) => {
      state.access = action.payload;
    },
    /** Store the JWT refresh token. */
    setRefreshToken: (state, action) => {
      state.refresh = action.payload;
    },

    /** Store sign-up form data during onboarding. */
    setSignUpData: (state, action) => {
      state.signUpData = action.payload;
    },

    /** Clear session, tokens, and auth flags on logout. */
    logout: (state) => {
      state.user = null;
      state.access = "";
      state.refresh = "";
      state.isAuthenticated = false;
    },

    /** Apply new access/refresh tokens after a successful refresh. */
    refreshTokenSuccess: (state, action) => {
      state.access = action.payload.access;
      state.refresh = action.payload.refresh;
    }, 

    /** Reset sign-up draft and confirm-password fields. */
    clearSignUpData: (state) => {
      state.signUpData = null;
      state.confirmPassword = "";
    },

    /** Set the confirm-password field during sign-up. */
    setConfirmPassword: (state, action) => {
      state.confirmPassword = action.payload;
    },
  },
});

export const {
  setUser,
  setIsLoading,
  setIsAuthenticated,
  setSignUpData,
  clearSignUpData,
  logout,
  setAccessToken,
  setRefreshToken,
  setConfirmPassword,
  refreshTokenSuccess,
} = authSlice.actions;
export default authSlice.reducer;
