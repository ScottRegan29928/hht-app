import React from "react";

interface Props {
  name: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SafeSection extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[SafeSection:${this.props.name}]`, error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "1rem", border: "2px solid red", margin: "0.5rem 0", borderRadius: "8px" }}>
          <strong style={{ color: "red" }}>Error in: {this.props.name}</strong>
          <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap" }}>{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
