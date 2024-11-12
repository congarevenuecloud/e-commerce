import { NgModule } from '@angular/core';
import { HttpClient, HTTP_INTERCEPTORS, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { AbstractSecurityStorage, AuthInterceptor, AuthModule, OpenIdConfiguration, StsConfigHttpLoader, StsConfigLoader } from 'angular-auth-oidc-client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthOptions } from '@congarevenuecloud/core';
import { StorageHandlerService } from '@congarevenuecloud/ecommerce';
import { config$ } from '../../main';
import { AuthorizationGuard } from './auth.guard';
import { AppComponent } from '../app.component';

export const httpLoaderFactory = () => {

  const authOptions$: Observable<OpenIdConfiguration> = config$.pipe(
    map((authOptions: AuthOptions) => {
      let redirectUri = window.location.origin + window.location.pathname;
      if (redirectUri.endsWith('/')) {
        redirectUri = redirectUri.slice(0, -1);
      }
      return {
        authority: authOptions.authEndpoint,
        redirectUrl: redirectUri,
        postLogoutRedirectUri: redirectUri,
        clientId: authOptions.spaClientId,
        scope: 'openid profile offline_access',
        responseType: 'code',
        secureRoutes: [authOptions.apiEndpoint, authOptions.authEndpoint, 'https://conga.mxlab.io'],
        silentRenew: true,
        useRefreshToken: true,
        ignoreNonceAfterRefresh: true,
        automaticSilentRenew: true,
        disableIdTokenValidation: true,
        autoUserInfo: false
      } as OpenIdConfiguration;
    })
  );
  return new StsConfigHttpLoader(authOptions$);
};

@NgModule({
  imports: [
    AuthModule.forRoot({
      loader: {
        provide: StsConfigLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient],
      },
    })
  ],
  providers: [
    {
      provide: AbstractSecurityStorage,
      useClass: StorageHandlerService
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: class implements HttpInterceptor {
        intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
          // Exclude Authorization header for /assets/i18n/ requests.
          if (request.url.includes('/assets/i18n/')) {
            // Clone the request without the Authorization header.
            const clonedRequest = request.clone({
              setHeaders: { Authorization: '' }
            });
            return next.handle(clonedRequest);
          }
          // Otherwise, pass the request through unchanged.
          return next.handle(request);
        }
      },
      multi: true
    }, AuthorizationGuard
  ],
  exports: [AuthModule],
  bootstrap: [AppComponent]
})
export class AuthConfigModule { }
