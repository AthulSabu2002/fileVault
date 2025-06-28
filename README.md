# File Vault

A secure file storage and retrieval system that allows authorized users to upload, download, and manage their files.

## Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web server framework
- **TypeScript** - Programming language
- **Supabase** - Backend-as-a-Service for authentication and file storage
- **Object-Oriented Programming** - Class-based architecture

## Features

- Secure file upload and storage
- File retrieval for authorized users
- User authentication and authorization
- File metadata management
- Clean class-based architecture

## Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd file_vault

# Install dependencies
npm install
```

## Configuration

Create a `.env` file in the project root with the following variables:

```
PORT=3000 SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
NODE_ENV=development
```

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/signin` - Login and receive an access token
- `POST /api/auth/refresh` - Refresh an expired token

### File Operations

- `GET /api/files` - List all files accessible to the user
- `POST /api/files/upload` - Upload a new file (with multer handling)
- `POST /api/files/download` - Download a specific file using file ID
- `PATCH /api/files/rename` - Update file name
- `DELETE /api/files` - Delete a file

## Project Structure

```
file_vault/
├── src/
│   ├── controllers/       # Request handlers (FileController, AuthController)
│   ├── core/              # Application core (App)
│   ├── middlewares/       # Express middlewares (VerifyToken, ErrorMiddleware)
│   ├── routes/            # API routes (FileRoutes, AuthRoutes)
│   ├── types/             # Type definitions
│   ├── utils/             # Utility functions (supabaseClient)
│   └── server.ts          # Entry point
├── tsconfig.json          # TypeScript configuration
├── package.json           # Project dependencies
└── README.md              # This file
```

## Authentication and Authorization

The application uses Supabase Authentication with JWT tokens for user management and access control. To access protected endpoints, include the token in your request headers:

```
Authorization: Bearer <your_token>
```

The system supports:

- Email/password authentication
- Token refresh functionality
- User-specific file access controls

## Error Handling

The API returns standard HTTP status codes and JSON error responses:

```json
{
  "status": "error",
  "message": "Error message details"
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request