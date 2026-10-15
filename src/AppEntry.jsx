import { lazy, Suspense } from 'react';
const App = lazy(() => import('./App.jsx'));
const AssetShowroom = lazy(() => import('./game/AssetShowroom.jsx'));
export default function AppEntry() {
  const showroom = new URLSearchParams(window.location.search).has('showroom');
  return <Suspense fallback={null}>{showroom ? <AssetShowroom /> : <App />}</Suspense>;
}
