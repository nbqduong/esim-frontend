<template>
  <div
    class="w-auto h-auto collapse navbar-collapse max-height-vh-100 h-100"
    id="sidenav-collapse-main"
  >
    <ul class="navbar-nav">
      <li class="nav-item">
        <sidenav-collapse navText="Home" :to="{ name: 'Home' }">
          <template #icon>
            <shop />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Project" :to="{ name: 'Project' }">
          <template #icon>
            <office />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Template" :to="{ name: 'Template' }">
          <template #icon>
            <document />
          </template>
        </sidenav-collapse>
      </li>

      <li class="nav-item">
        <sidenav-collapse navText="Documents" :to="{ name: 'Documents' }">
          <template #icon>
            <getting-started />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Pricing" :to="{ name: 'Pricing' }">
          <template #icon>
            <credit-card />
          </template>
        </sidenav-collapse>
      </li>
      <li class="nav-item">
        <sidenav-collapse navText="Settings" :to="{ name: 'User Settings' }">
          <template #icon>
            <settings />
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
import Shop from "../../assets/Icon/Shop.vue";
import Office from "../../assets/Icon/Office.vue";
import CreditCard from "../../assets/Icon/CreditCard.vue";
import CustomerSupport from "../../assets/Icon/CustomerSupport.vue";
import Document from "../../assets/Icon/Document.vue";
import GettingStarted from "../../assets/Icon/GettingStarted.vue";
import Spaceship from "../../assets/Icon/Spaceship.vue";
import Settings from "../../assets/Icon/Settings.vue";

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
    Shop,
    Office,
    CreditCard,
    CustomerSupport,
    Document,
    GettingStarted,
    Spaceship,
    Settings,
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
