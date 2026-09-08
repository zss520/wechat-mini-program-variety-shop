import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import AdminLayout from "./layouts/AdminLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GoodsList from "./pages/GoodsList";
import GoodsForm from "./pages/GoodsForm";
import Categories from "./pages/Categories";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Banners from "./pages/Banners";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Recommends from "./pages/Recommends";
import Password from "./pages/Password";

function Guard() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/goods" element={<GoodsList />} />
        <Route path="/goods/new" element={<GoodsForm />} />
        <Route path="/goods/:id" element={<GoodsForm />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/contents/banners" element={<Banners />} />
        <Route path="/contents/recommends" element={<Recommends />} />
        <Route path="/shop/settings" element={<Settings />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/account/password" element={<Password />} />
      </Route>
    </Routes>
  );
}
