import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  Home,
  Images,
  LayoutDashboard,
  LogIn,
  LogOut,
  Receipt,
  Settings,
  Shield,
  Upload,
  User,
  Users,
} from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const publicItems = [
  { title: "Início", url: "/", icon: Home },
];

const operatorItems = [
  { title: "Dashboard", url: "/operador", icon: LayoutDashboard, exact: true },
  { title: "Galeria", url: "/operador/galeria", icon: Images },
  { title: "Enviar foto", url: "/operador/upload", icon: Upload },
  { title: "Vendas", url: "/operador/vendas", icon: Receipt },
  { title: "Configurações", url: "/operador/configuracoes", icon: Settings },
];

const customerItems = [
  { title: "Minhas fotos", url: "/cliente", icon: Images },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { userId, email, isOperator, isCustomer, signOut } = useAuth();
  const settings = useSettings();


  const isActive = (path: string, exact?: boolean) =>
    path === "/" || exact ? currentPath === path : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-sunset shadow-glow">
            <Camera className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base font-bold">{settings.siteName}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {settings.siteTagline}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {publicItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOperator && (
          <SidebarGroup>
            <SidebarGroupLabel>Operador</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {operatorItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url, (item as any).exact)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isCustomer && (
          <SidebarGroup>
            <SidebarGroupLabel>Cliente</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {customerItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!userId && (
          <SidebarGroup>
            <SidebarGroupLabel>Entrar</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/login-cliente")}>
                    <Link to="/login-cliente">
                      <User className="h-4 w-4" />
                      <span>Sou cliente</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/login-operador")}>
                    <Link to="/login-operador">
                      <LogIn className="h-4 w-4" />
                      <span>Sou operador</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {userId && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          {!collapsed && (
            <div className="mb-2 truncate text-xs text-muted-foreground">
              {email}
            </div>
          )}
          {isOperator && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mb-2 w-full justify-start gap-2"
            >
              <Link to="/operador/usuarios">
                <Users className="h-4 w-4" />
                {!collapsed && <span>Novo operador</span>}
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
