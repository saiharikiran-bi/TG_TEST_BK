export const getOverallData = async (req, res) => {
    try {
        // This is where you would normally fetch data from the database
        // For now, we'll throw an error to trigger the catch block with dummy data
        throw new Error('Database connection failed');
    } catch (error) {
        console.error('Error fetching overall data:', error);
        
        // Dummy data in catch block as requested
        const dummyData = [
            {
                id: 1,
                name: 'John Doe',
                email: 'john.doe@example.com',
                phone: '+1-555-0123',
                status: 'Active',
                role: 'Administrator',
                department: 'IT',
                joinDate: '2023-01-15',
                lastLogin: '2024-01-20 10:30:00'
            },
            {
                id: 2,
                name: 'Jane Smith',
                email: 'jane.smith@example.com',
                phone: '+1-555-0124',
                status: 'Active',
                role: 'Manager',
                department: 'Sales',
                joinDate: '2023-03-20',
                lastLogin: '2024-01-19 14:45:00'
            },
            {
                id: 3,
                name: 'Mike Johnson',
                email: 'mike.johnson@example.com',
                phone: '+1-555-0125',
                status: 'Inactive',
                role: 'Developer',
                department: 'Engineering',
                joinDate: '2023-02-10',
                lastLogin: '2024-01-15 09:15:00'
            },
            {
                id: 4,
                name: 'Sarah Wilson',
                email: 'sarah.wilson@example.com',
                phone: '+1-555-0126',
                status: 'Active',
                role: 'Analyst',
                department: 'Finance',
                joinDate: '2023-04-05',
                lastLogin: '2024-01-20 16:20:00'
            },
            {
                id: 5,
                name: 'David Brown',
                email: 'david.brown@example.com',
                phone: '+1-555-0127',
                status: 'Active',
                role: 'Supervisor',
                department: 'Operations',
                joinDate: '2023-01-30',
                lastLogin: '2024-01-18 11:30:00'
            }
        ];

        res.json({
            success: true,
            data: dummyData,
            message: 'Overall data retrieved successfully (dummy data)',
            totalCount: dummyData.length
        });
    }
}; 