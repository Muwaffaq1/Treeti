/**
 * Shown inside the shell while the next tab loads. The shell and its navigation stay put; this
 * placeholder only fades in if loading takes longer than a moment, so quick switches don't flicker.
 */
export function PageLoading(){
  return <div className="page-loading" role="status" aria-label="Loading">
    <span className="page-loading-bar page-loading-title"/>
    <span className="page-loading-bar page-loading-line"/>
    <span className="page-loading-card"/>
    <span className="page-loading-card"/>
    <span className="page-loading-card short"/>
  </div>;
}
