export const dynamic = "force-static";

export default function StaticLoginRedirect() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-wide">
            🍽 Recipe Book
          </h1>
          <p className="text-muted-foreground text-sm mt-1">family recipes, curated</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Loading login form...</p>
        </div>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const form = document.createElement('form');
              form.method = 'POST';
              form.action = '/api/auth/callback/credentials';
              form.style.cssText = 'display:flex;flex-direction:column;gap:1rem';
              
              const emailDiv = document.createElement('div');
              emailDiv.innerHTML = '<label style="display:block;margin-bottom:0.5rem;font-size:0.875rem;font-weight:500">Email</label><input type="email" name="email" required style="width:100%;padding:0.5rem;border:1px solid #D6CEC4;border-radius:0.5rem;background:#fff" value="admin@family.local" />';
              
              const passDiv = document.createElement('div');
              passDiv.innerHTML = '<label style="display:block;margin-bottom:0.5rem;font-size:0.875rem;font-weight:500">Password</label><input type="password" name="password" required style="width:100%;padding:0.5rem;border:1px solid #D6CEC4;border-radius:0.5rem;background:#fff" />';
              
              const button = document.createElement('button');
              button.type = 'submit';
              button.textContent = 'Sign in';
              button.style.cssText = 'width:100%;padding:0.5rem;background:#A8956A;color:#fff;border:none;border-radius:0.5rem;font-weight:500;cursor:pointer';
              
              form.appendChild(emailDiv);
              form.appendChild(passDiv);
              form.appendChild(button);
              
              document.querySelector('.text-center:last-child').replaceWith(form);
            })();
          `
        }} />
      </div>
    </div>
  );
}
