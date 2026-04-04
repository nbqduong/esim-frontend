import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import Project from "@/views/Project.vue";
import Template from "@/views/Template.vue";
import Documents from "@/views/Documents.vue";
import Pricing from "@/views/Pricing.vue";
import UserSettings from "@/views/UserSettings.vue";
import SignIn from "@/views/SignIn.vue";
import SignUp from "@/views/SignUp.vue";

const routes = [
  {
    path: "/",
    name: "/",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "Home",
    component: Home,
  },
  {
    path: "/project",
    name: "Project",
    component: Project,
  },
  {
    path: "/template",
    name: "Template",
    component: Template,
  },
  {
    path: "/documents",
    name: "Documents",
    component: Documents,
  },
  {
    path: "/pricing",
    name: "Pricing",
    component: Pricing,
  },
  {
    path: "/user-settings",
    name: "User Settings",
    component: UserSettings,
  },
  {
    path: "/tables",
    redirect: { name: "Project" },
  },
  {
    path: "/billing",
    redirect: { name: "Pricing" },
  },
  {
    path: "/virtual-reality",
    redirect: { name: "Template" },
  },
  {
    path: "/profile",
    redirect: { name: "User Settings" },
  },
  {
    path: "/sign-in",
    name: "Sign In",
    component: SignIn,
  },
  {
    path: "/sign-up",
    name: "Sign Up",
    component: SignUp,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  linkActiveClass: "active",
});

export default router;
