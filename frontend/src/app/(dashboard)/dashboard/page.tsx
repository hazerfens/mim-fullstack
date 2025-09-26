import React from 'react'
import { getServerSession } from '@/lib/auth';


const Dashboard = async () => {
  const user = await getServerSession();

  console.log("user in dashboard page:", user);
  
  return (
    <div>
      <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Hoş geldin, {user?.email || "-"}!<br />
                  Rol: {user?.role || "-"}<br />
                  Email: {user?.email || "-"}<br />
                  Kullanıcı ID: {user?.id || "-"}<br />
                  image_url: {user?.image_url || "-"}
                  
                </p>
              </div>
    </div>
  )
}

export default Dashboard