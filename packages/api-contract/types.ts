export type User = {
  id: string;
  username: string;
  display_name: string;
  email?: string;
  platform_role: string;
  must_change_password: boolean;
};
export type Member = {
  user_id: string;
  role: "room_admin" | "room_member";
  status: string;
  display_name?: string;
  username?: string;
};
export type Room = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  status: string;
  members: Member[];
  settings: { allow_member_expenses: boolean };
};
export type Category = { id: string; name: string; is_active: boolean };
export type Expense = {
  id: string;
  expense_date: string;
  description: string;
  category_id?: string;
  total_paise: number;
  amount_paise?: number;
  paid_by: string;
  created_by: string;
  status: string;
  split_type: string;
  splits: { user_id: string; share_paise: number }[];
  notes?: string;
};
export type Balance = {
  user_id: string;
  paid_paise: number;
  share_paise: number;
  net_paise: number;
  settlements_paid_paise: number;
  settlements_received_paise: number;
};
export type Transfer = {
  from_user_id: string;
  to_user_id: string;
  amount_paise: number;
};
export type Settlement = Transfer & {
  id: string;
  status: string;
  payment_method: string;
  note: string;
  created_at: string;
};
export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  status: string;
};
export type Page<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};
export type Report = {
  total_paise: number;
  count: number;
  by_category: { category_id: string; amount_paise: number }[];
  by_month: { month: string; amount_paise: number }[];
  by_payer: { user_id: string; amount_paise: number }[];
  member_totals?: Balance[];
};
