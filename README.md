# Network Dashboard System

A comprehensive network monitoring and management dashboard with real-time device monitoring, alerting, and ticket management.

## Quick Start

### Option 1: Desktop Shortcut (Recommended)
1. Double-click the "Network Dashboard" shortcut on your desktop
2. The dashboard will start automatically
3. Open your browser to http://localhost:5173
4. Login with: **wanzala** / **wanzala@2026**

### Option 2: Manual Start
1. Run `start-dashboard.bat` from the project directory
2. Wait for both servers to start
3. Access http://localhost:5173 in your browser

### Option 3: Windows Service (Advanced)
Run PowerShell as Administrator and execute:
```powershell
.\dashboard-service.ps1
```

## System Overview

### Backend Server (Port 3001)
- **API Endpoint**: http://localhost:3001
- **Database**: MySQL with complete schema
- **Features**: Real-time monitoring, WebSocket updates, security monitoring
- **Admin User**: wanzala / wanzala@2026

### Frontend Application (Port 5173)
- **Dashboard URL**: http://localhost:5173
- **Technology**: React with Vite
- **Features**: Real-time updates, responsive design, authentication

## Dashboard Features

### 🖥️ Network Monitoring
- **Device Status**: Real-time online/offline status
- **Health Score**: Overall network health percentage
- **Traffic Analysis**: Network bandwidth usage charts
- **Speed Monitoring**: Download/upload speed tracking

### 🚨 Alert System
- **Automatic Alerts**: Device offline/degraded status
- **Alert Management**: Acknowledge and resolve alerts
- **Real-time Updates**: WebSocket-powered notifications

### 🎫 Ticket Management
- **User Reporting**: Submit network issues
- **Admin Response**: Track ticket status and responses
- **SLA Tracking**: Monitor response and resolution times

### 🔒 Security Monitoring
- **Device Tampering**: Detect unauthorized changes
- **Audit Logs**: Track all system activities
- **Real-time Alerts**: Immediate security notifications

### 👥 User Management
- **Role-based Access**: Admin, technician, viewer, user roles
- **Authentication**: JWT-based secure login
- **Password Management**: Reset and change passwords

## File Structure

```
network-tracking/
├── backend/              # Node.js API server
│   ├── server.js        # Main server file
│   ├── db.js           # Database operations
│   ├── security.js     # Security monitoring
│   └── package.json    # Backend dependencies
├── frontend/           # React dashboard
│   ├── src/           # Source code
│   ├── vite.config.ts # Build configuration
│   └── package.json   # Frontend dependencies
├── start-dashboard.bat # Startup script
├── dashboard-service.ps1 # Windows service installer
├── create-shortcut.ps1 # Desktop shortcut creator
└── README.md         # This file
```

## Database Schema

The system uses MySQL with the following tables:
- **devices**: Network device information
- **alerts**: System alerts and notifications
- **messages**: User tickets and support requests
- **events**: System events and logs
- **users**: User accounts and authentication
- **settings**: System configuration
- **audit_logs**: Security and activity logs

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/signup` - User registration
- `POST /api/forgot-password` - Password recovery

### Dashboard Data
- `GET /api/stats` - Network statistics
- `GET /api/health` - Network health score
- `GET /api/speed` - Network speed data
- `GET /api/traffic` - Traffic samples

### Device Management
- `GET /api/devices` - List all devices
- `POST /api/devices` - Add new device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Remove device

### Alert Management
- `GET /api/alerts` - List alerts
- `PUT /api/alerts/:id` - Update alert status
- `DELETE /api/alerts/:id` - Delete alert

### Ticket System
- `GET /api/messages` - List tickets
- `POST /api/messages` - Create ticket
- `PUT /api/messages/:id` - Update ticket

## Troubleshooting

### Dashboard Won't Start
1. Ensure Node.js is installed (version 18+)
2. Run `npm install` in both `backend/` and `frontend/` directories
3. Check that ports 3001 and 5173 are not in use
4. Verify MySQL server is running

### Database Connection Issues
1. Check MySQL server is running
2. Verify credentials in `backend/.env`
3. Ensure database 'network_tracker' exists
4. Run `node backend/create_mysql_tables.js` to create tables

### Authentication Problems
1. Default admin: wanzala / wanzala@2026
2. Check that users table has been seeded
3. Verify JWT secret is set in environment

### Network Access Issues
1. Ensure firewall allows ports 3001 and 5173
2. Check MySQL port (default 3306) is accessible
3. Verify network connectivity

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Different permission levels
- **Security Monitoring**: Real-time threat detection
- **Audit Logging**: Complete activity tracking
- **Input Validation**: Protection against injection attacks
- **Rate Limiting**: Protection against brute force attacks

## Development

### Backend Development
```bash
cd backend
npm run dev  # Start with file watching
```

### Frontend Development
```bash
cd frontend
npm run dev  # Start development server
```

### Production Build
```bash
cd frontend
npm run build  # Create production build
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the system logs in the terminal
3. Verify all services are running
4. Check network connectivity

## License

This project is for educational and personal use.