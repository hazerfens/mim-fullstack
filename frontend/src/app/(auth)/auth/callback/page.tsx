import { cookies } from 'next/headers'
import React from 'react'

const Auth = async () => {
    const cookieStore = await cookies()

    const accessToken = cookieStore.get("access_token")
  return (
    <div>{accessToken ? <p>Authenticated</p> : <p>Please log in</p>}
    {accessToken && <p>Access Token: {accessToken.value}</p>}

    </div>
  )
}

export default Auth