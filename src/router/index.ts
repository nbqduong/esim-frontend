import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import Project from "@/views/Project.vue";
import ProjectCreate from "@/views/ProjectCreate.vue";
import Template from "@/views/Template.vue";
import Documents from "@/views/Documents.vue";
import Pricing from "@/views/Pricing.vue";
import Community from "@/views/Community.vue";
import UserSettings from "@/views/UserSettings.vue";


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
    path: "/project/create",
    name: "Project Create",
    component: ProjectCreate,
    meta: {
      layout: "standalone",
    },
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
    path: "/community",
    name: "Community",
    component: Community,
  },
  {
    path: "/user-settings",
    name: "User Settings",
    component: UserSettings,
  },
  {
    path: "/not-authorized",
    name: "Not Authorized",
    redirect: { name: "Home" },
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
    path: "/profile",
    redirect: { name: "User Settings" },
  },

]
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  linkActiveClass: "active",
});

export default router;
