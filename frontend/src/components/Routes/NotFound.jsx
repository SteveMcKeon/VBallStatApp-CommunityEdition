import { Link } from 'react-router-dom';
const NotFound = () => (
  <div className="h-screen flex flex-col items-center justify-center text-center">
    <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
    <p className="text-gray-500 mb-6">Oops! That page doesn't exist.</p>
    <Link to="/" className="text-blue-600 underline">
      Go to Home
    </Link>
  </div>
);
export default NotFound;
