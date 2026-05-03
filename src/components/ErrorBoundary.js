import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '40vh',
          gap: '16px',
          color: '#ccc',
          textAlign: 'center',
          padding: '32px'
        }}>
          <h2 style={{ color: '#fff', margin: 0 }}>Qualcosa è andato storto</h2>
          <p style={{ margin: 0 }}>Si è verificato un errore imprevisto in questa sezione.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '10px 24px',
              background: '#1a73e8',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
