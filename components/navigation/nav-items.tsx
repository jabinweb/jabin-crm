import { 
  Home, User, Calendar, Users, Building2, Settings, 
  LayoutDashboard, Package, Box, ArrowLeftRight, ClipboardList,
  Package2, ShoppingCart, Truck, BarChart, Building, Clock,
  Wallet, Bell, MessageSquare
} from 'lucide-react'

export interface NavItem {
  href: string
  title: string
  icon?: React.ReactNode
  module?: string
  requiredRole?: ('SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE')[]
  subItems?: NavItem[]
}

interface NavItems {
  EMPLOYEE: NavItem[]
  ADMIN: NavItem[]
  SUPER_ADMIN: NavItem[]
}

const inventoryNavItems: NavItem[] = [
  {
    href: "/dashboard/inventory",
    title: "Overview",
    icon: <Package className="mr-2 h-4 w-4" />
  },
  {
    href: "/dashboard/inventory/stock-adjustment",
    title: "Stock Adjustment",
    icon: <Box className="mr-2 h-4 w-4" />,
    requiredRole: ['ADMIN', 'MANAGER']
  },
  {
    href: "/dashboard/inventory/transfers",
    title: "Stock Transfer",
    icon: <ArrowLeftRight className="mr-2 h-4 w-4" />,
    requiredRole: ['ADMIN', 'MANAGER']
  },
  {
    href: "/dashboard/inventory/batches",
    title: "Batch Management",
    icon: <ClipboardList className="mr-2 h-4 w-4" />
  }
]

export const NAV_ITEMS: NavItems = {
  EMPLOYEE: [
    {
      href: '/employee/dashboard',
      title: 'Dashboard',
      icon: <Home className="mr-2 h-4 w-4" />
    },
    {
      href: '/employee/profile',
      title: 'Profile',
      icon: <User className="mr-2 h-4 w-4" />
    },
    // HRMS items below have no `module` key — always visible; not subscription-gated.
    {
      href: '/employee/attendance',
      title: 'Attendance',
      icon: <Clock className="mr-2 h-4 w-4" />
    },
    {
      href: '/employee/payslips',
      title: 'Payslips',
      icon: <Wallet className="mr-2 h-4 w-4" />
    },
    {
      href: '/employee/leave',
      title: 'Leave',
      icon: <Calendar className="mr-2 h-4 w-4" />
    },
    {
      href: "/employee/leads",
      title: "Leads",
      icon: <User className="mr-2 h-4 w-4" />,
      module: 'LEADS',
    },
    {
      href: '/employee/tasks',
      title: 'Tasks',
      icon: <ClipboardList className="mr-2 h-4 w-4" />
    },
    {
      href: '/employee/announcements',
      title: 'Announcements',
      icon: <Bell className="mr-2 h-4 w-4" />
    },
    {
      href: '/employee/messages',
      title: 'Messages',
      icon: <MessageSquare className="mr-2 h-4 w-4" />
    }
  ],
  ADMIN: [
 {
    href: "/dashboard",
    title: "Dashboard",
    icon: <Home className="mr-2 h-4 w-4" />,
  },
  {
    href: "/dashboard/inventory",
    title: "Inventory",
    icon: <Package className="mr-2 h-4 w-4" />,
    subItems: inventoryNavItems,
  },
  {
    href: "/dashboard/employees",
    title: "Employees",
    icon: <Package2 className="mr-2 h-4 w-4" />,
  },
  {
    href: "/dashboard/leads",
    title: "Leads",
    icon: <User className="mr-2 h-4 w-4" />,
  },
  {
    href: "/dashboard/products",
    title: "Products",
    icon: <ShoppingCart className="mr-2 h-4 w-4" />,
  },
  {
    href: "/dashboard/suppliers",
    title: "Suppliers",
    icon: <Truck className="mr-2 h-4 w-4" />,
    requiredRole: ['ADMIN', 'MANAGER'],
  },
  {
    href: "/dashboard/reports",
    title: "Reports",
    icon: <BarChart className="mr-2 h-4 w-4" />,
    requiredRole: ['ADMIN', 'MANAGER'],
  },
  {
    href: "/dashboard/customers",
    title: "Customers",
    icon: <Building className="mr-2 h-4 w-4" />,
    requiredRole: ['ADMIN'],
  },
  {
    href: "/dashboard/messages",
    title: "Messages",
    icon: <MessageSquare className="mr-2 h-4 w-4" />,
    requiredRole: ['ADMIN'],
  },
  {
    href: "/dashboard/settings",
    title: "Settings",
    icon: <Settings className="mr-2 h-4 w-4" />,
    requiredRole: ['ADMIN', 'MANAGER'],
  },
  {
    href: "/employee/dashboard",
    title: "Employee Dashboard",
    icon: <Users className="mr-2 h-4 w-4" />,
    requiredRole: ['EMPLOYEE'],
  },
  ],
  SUPER_ADMIN: [
    {
      href: '/admin',
      title: 'Dashboard',
      icon: <LayoutDashboard className="mr-2 h-4 w-4" />
    },
    {
      href: '/admin/companies',
      title: 'Companies',
      icon: <Building2 className="mr-2 h-4 w-4" />
    },
    {
      href: '/admin/reports',
      title: 'Reports',
      icon: <BarChart className="mr-2 h-4 w-4" />
    },
    {
      href: '/admin/settings',
      title: 'Settings',
      icon: <Settings className="mr-2 h-4 w-4" />
    }
  ]
}
