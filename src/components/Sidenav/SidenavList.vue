<template>
  <div
    class="w-auto h-auto collapse navbar-collapse max-height-vh-100 h-100"
    id="sidenav-collapse-main"
  >
    <ul class="navbar-nav">
      <li class="nav-item">
        <sidenav-collapse navText="Home" :to="{ name: 'Home' }">
          <template #icon>
            <sidenav-line-icon name="home" />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Project" :to="{ name: 'Project' }">
          <template #icon>
            <sidenav-line-icon name="project" />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Template" :to="{ name: 'Template' }">
          <template #icon>
            <sidenav-line-icon name="template" />
          </template>
        </sidenav-collapse>
      </li>

      <li class="nav-item">
        <sidenav-collapse navText="Documents" :to="{ name: 'Documents' }">
          <template #icon>
            <sidenav-line-icon name="documents" />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Pricing" :to="{ name: 'Pricing' }">
          <template #icon>
            <sidenav-line-icon name="pricing" />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Community" :to="{ name: 'Community' }">
          <template #icon>
            <sidenav-line-icon name="community" />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Settings" :to="{ name: 'User Settings' }">
          <template #icon>
            <sidenav-line-icon name="settings" />
          </template>
        </sidenav-collapse>
      </li>
    </ul>
  </div>
</template>
<script lang="ts">
import { computed } from "vue";
import SidenavCollapse from "./SidenavCollapse.vue";
import SidenavCard from "./SidenavCard.vue";
import SidenavLineIcon from "./SidenavLineIcon.vue";

export default {
  name: "SidenavList",
  props: {
    cardBg: String,
    isMiniSidebar: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      title: "Soft UI Dashboard PRO",
      controls: "dashboardsExamples",
      isActive: "active",
    };
  },
  components: {
    SidenavCollapse,
    SidenavCard,
    SidenavLineIcon,
  },
  provide() {
    return {
      isMiniSidebar: computed(() => this.isMiniSidebar)
    };
  },
  methods: {
    getRoute() {
      const routeArr = this.$route.path.split("/");
      return routeArr[1];
    },
  },
};
</script>
