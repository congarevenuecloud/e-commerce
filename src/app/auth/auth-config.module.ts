import { NgModule } from '@angular/core';
import { HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor, AuthModule, OpenIdConfiguration, StsConfigHttpLoader, StsConfigLoader } from 'angular-auth-oidc-client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthOptions } from '@congarevenuecloud/core';
import { config$ } from '../../main';
import { AuthorizationGuard } from './auth.guard';
import { AppComponent } from '../app.component';

export const httpLoaderFactory = () => {

  const authOptions$: Observable<OpenIdConfiguration> = config$.pipe(
    map((authOptions: AuthOptions) => {
      return {
        authority: authOptions.authEndpoint,
        redirectUrl: window.location.origin + window.location.pathname,
        postLogoutRedirectUri: window.location.origin + window.location.pathname,
        clientId: authOptions.spaClientId,
        scope: 'openid profile offline_access',
        responseType: 'code',
        secureRoutes: [authOptions.apiEndpoint, authOptions.authEndpoint],
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
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }, AuthorizationGuard
  ],
  exports: [AuthModule],
  bootstrap: [AppComponent]
})
export class AuthConfigModule { }
