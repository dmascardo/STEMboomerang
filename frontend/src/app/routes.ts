import { createBrowserRouter } from "react-router";
import { UploadPage } from "./pages/upload-page";
import { ReviewPage } from "./pages/review-page";
import { DashboardPage } from "./pages/dashboard-page";
import { RootLayout } from "./layouts/root-layout";

export const router = createBrowserRouter([
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
]);