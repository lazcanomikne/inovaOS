import HomePage from '@/pages/HomePage.vue';
import CapturaPage from '@/pages/CapturaPage.vue';
import PendientesPage from '@/pages/PendientesPage.vue';
import PendienteDetallePage from '@/pages/PendienteDetallePage.vue';
import EditarPendientePage from '@/pages/EditarPendientePage.vue';
import TableroPage from '@/pages/TableroPage.vue';
import MetricasPage from '@/pages/MetricasPage.vue';
import AsistentePage from '@/pages/AsistentePage.vue';
import PerfilPage from '@/pages/PerfilPage.vue';
import NotFoundPage from '@/pages/NotFoundPage.vue';

const routes = [
  { path: '/', component: HomePage },
  { path: '/captura/', component: CapturaPage },
  { path: '/pendientes/', component: PendientesPage },
  { path: '/pendientes/:id/', component: PendienteDetallePage },
  { path: '/pendientes/:id/editar/', component: EditarPendientePage },
  { path: '/tablero/', component: TableroPage },
  { path: '/metricas/', component: MetricasPage },
  { path: '/asistente/', component: AsistentePage },
  { path: '/perfil/', component: PerfilPage },
  { path: '(.*)', component: NotFoundPage },
];

export default routes;
