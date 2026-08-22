import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import './NotFound.css';

export function NotFound() {
  return (
    <div className="notfound-page">
      <main className="notfound-main">
        <div className="notfound-content">
          <h1 className="notfound-code">404</h1>
          <p className="notfound-message">
            This page doesn't <span className="highlight-term">exist</span>.
          </p>
          <Link to="/dashboard">
            <Button variant="primary" size="lg">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

export default NotFound;