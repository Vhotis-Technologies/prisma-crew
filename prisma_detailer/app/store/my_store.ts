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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = useSelector;

export default store;
