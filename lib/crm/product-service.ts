import { prisma } from '@/lib/prisma';
import { InstallationStatus, ProductType } from '@prisma/client';

export interface CreateProductData {
    name: string;
    category?: string;
    description?: string;
    manufacturer?: string;
    modelNumber?: string;
    type?: ProductType;
    companyId: string;
}

export interface CreateInstallationData {
    productId: string;
    customerId: string;
    serialNumber?: string;
    installationDate?: Date;
    warrantyExpiry?: Date;
    status?: InstallationStatus;
    notes?: string;
}

export class ProductService {
    /**
     * Create a new product in the catalog
     */
    async createProduct(data: CreateProductData) {
        const { companyId, ...rest } = data
        return await prisma.product.create({
            data: { ...rest, companyId },
        });
    }

    /**
     * List products for a company (tenant-scoped).
     */
    async listProducts(companyId: string, category?: string) {
        return await prisma.product.findMany({
            where: {
                companyId,
                ...(category ? { category } : {}),
            },
            orderBy: { name: 'asc' },
        });
    }

    /** Platform-wide listing (e.g. super admin without workspace header). */
    async listAllProducts(category?: string) {
        return await prisma.product.findMany({
            where: category ? { category } : {},
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Record a new equipment installation
     */
    async installEquipment(data: CreateInstallationData) {
        const installation = await prisma.equipmentInstallation.create({
            data: {
                productId: data.productId,
                customerId: data.customerId,
                serialNumber: data.serialNumber,
                installationDate: data.installationDate || new Date(),
                warrantyExpiry: data.warrantyExpiry,
                status: data.status || 'ACTIVE',
                notes: data.notes,
            },
            include: {
                product: true,
                customer: true,
            },
        });

        // Log activity on the customer record
        await prisma.customerActivity.create({
            data: {
                customerId: data.customerId,
                eventType: 'EQUIPMENT_INSTALLED',
                description: `Equipment installed: ${installation.product.name} (S/N: ${data.serialNumber || 'N/A'})`,
                metadata: { installationId: installation.id },
            },
        });

        return installation;
    }

    /**
     * Get equipment by ID
     */
    async getEquipmentById(id: string) {
        return await prisma.equipmentInstallation.findUnique({
            where: { id },
            include: {
                product: true,
                customer: true,
                tickets: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });
    }

    /**
     * Update installation status or notes
     */
    async updateEquipment(id: string, data: Partial<CreateInstallationData>) {
        return await prisma.equipmentInstallation.update({
            where: { id },
            data: {
                status: data.status,
                notes: data.notes,
                warrantyExpiry: data.warrantyExpiry,
                serialNumber: data.serialNumber,
            },
        });
    }

    /**
     * List installations for a customer
     */
    async getCustomerEquipment(customerId: string) {
        return await prisma.equipmentInstallation.findMany({
            where: { customerId },
            include: {
                product: true,
            },
            orderBy: { installationDate: 'desc' },
        });
    }
}

export const productService = new ProductService();
