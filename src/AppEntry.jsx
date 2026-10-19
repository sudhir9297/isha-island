import { lazy, Suspense } from 'react';
const App = lazy(() => import('./App.jsx'));
const AssetShowroom = lazy(() => import('./game/AssetShowroom.jsx'));
export default function AppEntry() {
  const showroom = new URLSearchParams(window.location.search).has('showroom');
  return <Suspense fallback={<div className="startup-intro startup-loading-screen"><div className="startup-loading" role="status"><span className="startup-loader" aria-hidden="true" /><span>Preparing the sea</span></div></div>}>{showroom ? <AssetShowroom /> : <App />}</Suspense>;
}
