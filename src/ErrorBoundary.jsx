import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={ hasError:false, error:null, info:null }; }
  static getDerivedStateFromError(error){ return { hasError:true, error }; }
  componentDidCatch(error, info){ this.setState({ info }); console.error("App crashed:", error, info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{ padding:24, fontFamily:"system-ui,-apple-system,Segoe UI,Roboto" }}>
          <h2>💥 页面运行出错</h2>
          <pre style={{ whiteSpace:"pre-wrap" }}>{String(this.state.error)}</pre>
          {this.state.info && (
            <details open>
              <summary>Stack</summary>
              <pre>{this.state.info.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
