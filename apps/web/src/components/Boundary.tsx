"use client";

import { Component, type ReactNode } from "react";
import { Notice } from "@/components/ui";

type Props = { resetKey: string; children: ReactNode };
type State = { error: Error | null; resetKey: string };

export class Boundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <Notice tone="error" title="This bench hit a snag">
            {this.state.error.message}
          </Notice>
        </div>
      );
    }
    return this.props.children;
  }
}
