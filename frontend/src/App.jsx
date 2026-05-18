import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import MainLayout from "./components/Mainlayout";
import Login from "./pages/Login";

import AdminDashboard from "./pages/AdminDashboard";
import UserManagement from "./pages/UserManagement";
import AdminHome from "./pages/AdminHome";
import EmployeeHome from "./pages/EmployeeHome";

import CreateLeave from "./pages/CreateLeave";
import LeaveHistory from "./pages/LeaveHistory";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />

        {/* === ADMIN ROUTES (Dành cho SUPERADMIN & MANAGER) === */}
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <MainLayout>
                <AdminHome />
              </MainLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/leaves"
          element={
            <PrivateRoute>
              <MainLayout>
                <AdminDashboard />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/leaves/new"
          element={
            <PrivateRoute>
              <MainLayout>
                <CreateLeave />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* 🔥 ĐÃ THÊM: ROUTE LỊCH SỬ ĐƠN CỦA MANAGER ĐỂ HẾT BỊ TRẮNG TRANG */}
        <Route
          path="/admin/leaves/history"
          element={
            <PrivateRoute>
              <MainLayout>
                <LeaveHistory />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <PrivateRoute>
              <MainLayout>
                <UserManagement />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* === EMPLOYEE ROUTES (Dành cho STAFF) === */}
        <Route
          path="/employee"
          element={
            <PrivateRoute>
              <MainLayout>
                <EmployeeHome />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/employee/leaves/new"
          element={
            <PrivateRoute>
              <MainLayout>
                <CreateLeave />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/employee/leaves/history"
          element={
            <PrivateRoute>
              <MainLayout>
                <LeaveHistory />
              </MainLayout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;