import DemoSwitcher from "@/components/DemoSwitcher";

export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <>
      <DemoSwitcher />
      {children}
    </>
  );
}
