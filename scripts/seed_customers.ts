import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const adminEmail = 'silasharshit@gmail.com';

    const adminUser = await prisma.user.findUnique({
        where: { email: adminEmail }
    });

    if (!adminUser) {
        console.error(`Admin user with email ${adminEmail} not found. Please log in first to create the account.`);
        process.exit(1);
    }

    const customers = [
        {
            hospitalName: 'City General Hospital',
            contactPerson: 'Dr. Sarah Jenkins',
            email: 'contact@citygeneral.com',
            phone: '+1-555-0100',
            address: '123 Medical Drive',
            city: 'New York',
            state: 'NY',
            notes: 'Key client in the northeast region.',
        },
        {
            hospitalName: 'Westside Clinic',
            contactPerson: 'Mark Torres',
            email: 'admin@westsideclinic.net',
            phone: '+1-555-0222',
            address: '456 West Ave',
            city: 'Los Angeles',
            state: 'CA',
            notes: 'High volume outpatient facility.',
        },
        {
            hospitalName: 'Central Valley Medical Center',
            contactPerson: 'Linda Chen',
            email: 'lchen@cvmc.org',
            phone: '+1-555-0345',
            address: '789 Valley Blvd',
            city: 'Chicago',
            state: 'IL',
            notes: 'New client, expanding into pediatric care.',
        },
        {
            hospitalName: 'Northshore Health',
            contactPerson: 'Robert Mills',
            email: 'rmills@northshorehealth.com',
            phone: '+1-555-0456',
            address: '101 North Road',
            city: 'Seattle',
            state: 'WA',
            notes: 'Requires monthly equipment calibration.',
        },
        {
            hospitalName: 'Sunnyvale Regional',
            contactPerson: 'Dr. Emily Foster',
            email: 'efoster@sunnyvaleregional.org',
            phone: '+1-555-0567',
            address: '202 Sun Blvd',
            city: 'Miami',
            state: 'FL',
            notes: 'VIP client since 2023.',
        }
    ];

    console.log('Seeding customers...');

    for (const customerData of customers) {
        const customer = await prisma.customer.create({
            data: customerData
        });
        console.log(`Created customer: ${customer.hospitalName}`);
    }

    console.log('Finished seeding customers.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
