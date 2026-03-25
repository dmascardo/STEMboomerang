import { createBrowserRouter } from "react-router";
import { UploadPage } from "./pages/upload-page";
import { ReviewPage } from "./pages/review-page";
import { DashboardPage } from "./pages/dashboard-page";
import { RootLayout } from "./layouts/root-layout";
import { LoginPage } from "./pages/login-page";
import { RequireAuth } from "./components/auth/require-auth";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    Component: RequireAuth,
    children: [
      {
        path: "/",
        Component: RootLayout,
        children: [
          {
            index: true,
            Component: DashboardPage,
          },
          {
            path: "upload",
            Component: UploadPage,
          },
          {
            path: "review/:id",
            Component: ReviewPage,
          },
        ],
      },
    ],
  },
]);
