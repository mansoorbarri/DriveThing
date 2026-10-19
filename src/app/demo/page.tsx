import { type Metadata } from "next";
import { DemoApp } from "~/components/demo/demo-app";

export const metadata: Metadata = {
  title: "DriveThing Demo - Hartwell Accounting",
  description:
    "Try DriveThing with a fictional accounting practice. No sign-up needed.",
};

export default function DemoPage() {
  return <DemoApp />;
}
