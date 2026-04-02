import { createApp } from 'vue'
import App from './App.vue'
import store from "./config";
import router from "./router";
import "./assets/scss/soft-ui-dashboard.scss";

const appInstance = createApp(App);
appInstance.use(store);
appInstance.use(router);
appInstance.mount("#app");
