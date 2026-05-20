/**
 * Redux store: auth/banking slices and RTK Query APIs for the detailer app.
 */
import { configureStore } from "@reduxjs/toolkit";
import authApi from "./api/authApi";
import authReducer from "./slices/authSlice";
import { useDispatch, useSelector } from "react-redux";
import dashboardApi from "./api/dashboardApi";
import earningApi from "./api/earningApi";
import appointmentsApi from "./api/appointmentsApi";  
import availabilityApi from "./api/availabilityApi";
import bankingReducer from "./slices/bankingSlice";
import bankingApi from "./api/bankingApi";
import profileApi from "./api/profileapi";
import notificationApi from "./api/notificationApi";

const store = configureStore({
  reducer: {
    auth: authReducer,
    banking: bankingReducer,
    [authApi.reducerPath]: authApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [earningApi.reducerPath]: earningApi.reducer,
    [appointmentsApi.reducerPath]: appointmentsApi.reducer,
    [availabilityApi.reducerPath]: availabilityApi.reducer,
    [bankingApi.reducerPath]: bankingApi.reducer,
    [profileApi.reducerPath]: profileApi.reducer,
    [notificationApi.reducerPath]: notificationApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      dashboardApi.middleware,
      earningApi.middleware,
      appointmentsApi.middleware,
      availabilityApi.middleware,
      bankingApi.middleware,
      profileApi.middleware,
      notificationApi.middleware,
    ),
});

/** Full Redux state shape for selectors and base query. */
export type RootState = ReturnType<typeof store.getState>;
/** Typed dispatch for thunks and slice actions. */
export type AppDispatch = typeof store.dispatch;

/** Typed `useDispatch` bound to the detailer store. */
export const useAppDispatch = () => useDispatch<AppDispatch>();
/** Typed `useSelector` for the detailer store. */
export const useAppSelector = useSelector;

export default store;
