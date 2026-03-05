import { prisma } from '@/lib/prisma';

export interface CreateCustomerData {
    hospitalName: string;
    contactPerson: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    notes?: string;
}

export interface CreateContactData {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
}

export class CustomerService {
    /**
     * Create a new customer
     */
    async createCustomer(data: CreateCustomerData) {
        const customer = await prisma.customer.create({
            data: {
                hospitalName: data.hospitalName,
                contactPerson: data.contactPerson,
                email: data.email,
                phone: data.phone,
                address: data.address,
                city: data.city,
                state: data.state,
                notes: data.notes,
            },
        });

        // Log activity
        await this.logActivity(customer.id, 'UPDATED', `Customer record created for ${customer.hospitalName}`);

        return customer;
    }

    /**
     * Get customer by ID with relations
     */
    async getCustomerById(id: string) {
        return await prisma.customer.findUnique({
            where: { id },
            include: {
                contacts: true,
                activities: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                equipmentInstallations: {
                    include: {
                        product: true,
                    },
                },
                _count: {
                    select: {
                        supportTickets: true,
                        equipmentInstallations: true,
                    },
                },
            },
        });
    }

    /**
     * Update customer
     */
    async updateCustomer(id: string, data: Partial<CreateCustomerData>) {
        const customer = await prisma.customer.update({
            where: { id },
            data,
        });

        await this.logActivity(id, 'UPDATED', `Customer information updated`);

        return customer;
    }

    /**
     * Add a contact to a customer
     */
    async addContact(customerId: string, data: CreateContactData) {
        const contact = await prisma.customerContact.create({
            data: {
                customerId,
                ...data,
            },
        });

        await this.logActivity(customerId, 'UPDATED', `New contact added: ${contact.name}`);

        return contact;
    }

    /**
     * Log a customer activity
     */
    async logActivity(customerId: string, eventType: string, description: string, metadata?: any) {
        return await prisma.customerActivity.create({
            data: {
                customerId,
                eventType,
                description,
                metadata: metadata || {},
            },
        });
    }

    /**
     * List customers with pagination and search
     */
    async listCustomers(params: {
        search?: string;
        city?: string;
        page?: number;
        limit?: number;
    }) {
        const { search, city, page = 1, limit = 10 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { hospitalName: { contains: search, mode: 'insensitive' } },
                { contactPerson: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (city) {
            where.city = city;
        }

        const [total, customers] = await Promise.all([
            prisma.customer.count({ where }),
            prisma.customer.findMany({
                where,
                skip,
                take: limit,
                orderBy: { hospitalName: 'asc' },
                include: {
                    _count: {
                        select: {
                            equipmentInstallations: true,
                            supportTickets: true,
                        },
                    },
                },
            }),
        ]);

        return {
            customers,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

export const customerService = new CustomerService();
