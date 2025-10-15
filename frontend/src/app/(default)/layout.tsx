import Header from '@/features/components/default/header'
import React from 'react'
import { getServerSession } from '@/lib/auth'

// User tipi tanımlaması
interface UserProps {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  role: "customer" | "user" | "admin" | "super_admin";
}

const HomeLayout = async ({children}: {children: React.ReactNode}) => {
  const userRaw = await getServerSession();
  let user: UserProps | undefined = undefined;
  if (userRaw) {
    user = {
      id: userRaw.id,
      name: userRaw.full_name || userRaw.firstName || userRaw.email || "Kullanıcı",
      email: userRaw.email,
      image: userRaw.image_url || userRaw.image || null,
      role: userRaw.role as "customer" | "user" | "admin" | "super_admin"
    };
  }

  return (
    <div>
      <Header user={user} />
        {children}
    </div>
  )
}

export default HomeLayout