export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({ status: 'success', message: 'Logged out successfully' }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': 'ikire_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
    },
  });
};
