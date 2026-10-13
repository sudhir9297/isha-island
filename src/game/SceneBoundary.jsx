import { Component } from "react";

export default class SceneBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="scene-error">
        <h1>The sea couldn't load</h1>
        <p>
          Port needs WebGL. Try enabling hardware acceleration in your browser.
        </p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
