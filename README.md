# File Vault

A secure file storage and retrieval system that allows authorized users to upload, download, and manage their files.

## Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web server framework
- **TypeScript** - Programming language
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
PORT=3000
STORAGE_PATH=./uploads
JWT_SECRET=your_secret_key
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

- `POST /api/auth/signUp` - Register a new user
- `POST /api/auth/signIn` - Login and receive an access token

### File Operations

<!-- - `POST /api/files/upload` - Upload a new file
- `POST /api/files/download` - Download a specific file
- `GET /api/files` - List all files accessible to the user
- `GET /api/files/:id` - Download a specific file
- `DELETE /api/files/:id` - Delete a file
- `PATCH /api/files/:id` - Update file metadata -->

## Project Structure

```
file_vault/
├── src/
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── models/            # Data models
│   ├── middlewares/       # Express middlewares
│   ├── utils/             # Utility functions
│   ├── routes/            # API routes
│   └── index.ts           # Entry point
├── uploads/               # File storage directory
├── tests/                 # Test files
├── tsconfig.json          # TypeScript configuration
├── package.json           # Project dependencies
└── README.md              # This file
```

## Authentication and Authorization

The application uses JWT (JSON Web Tokens) for authentication. To access protected endpoints, include the token in your request headers:

```
Authorization: Bearer <your_token>
```

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

## License

This project is licensed under the MIT License.
