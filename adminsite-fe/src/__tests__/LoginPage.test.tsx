import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock api
jest.mock("@/lib/api", () => ({
  login: jest.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    data: Record<string, unknown> | null;
    constructor(status: number, msg: string, data: Record<string, unknown> | null = null) {
      super(msg);
      this.status = status;
      this.data = data;
    }
  },
}));

import { login, ApiError } from "@/lib/api";

beforeEach(() => {
  mockPush.mockReset();
  (login as jest.Mock).mockReset();
});

describe("LoginPage", () => {
  test("renders login form", () => {
    render(<LoginPage />);
    expect(screen.getByText("SystemEdu Admin")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  test("shows demo credentials hint", () => {
    render(<LoginPage />);
    // The hint text contains both "demo" and "demo1234"
    const hint = screen.getByText(/demo1234/);
    expect(hint).toBeTruthy();
  });

  test("submits form and redirects on success", async () => {
    const user = userEvent.setup();
    (login as jest.Mock).mockResolvedValue({ access: "a", refresh: "r" });

    render(<LoginPage />);
    await user.type(screen.getByLabelText("Username"), "demo");
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(login).toHaveBeenCalledWith({ username: "demo", password: "demo1234" });
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  test("shows error on failed login", async () => {
    const user = userEvent.setup();
    const { ApiError: AE } = jest.requireMock("@/lib/api");
    (login as jest.Mock).mockRejectedValue(new AE(401, "Invalid credentials", { detail: "Invalid credentials" }));

    render(<LoginPage />);
    await user.type(screen.getByLabelText("Username"), "bad");
    await user.type(screen.getByLabelText("Password"), "bad");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
