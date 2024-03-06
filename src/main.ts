import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Observable, of } from 'rxjs';
import { ajax } from 'rxjs/ajax';
import { catchError, switchMap, take, shareReplay } from 'rxjs/operators';
import { AuthOptions } from '@congarevenuecloud/core';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

const authConfig: AuthOptions = {
  'authEndpoint': environment.authority,
  'apiEndpoint': environment.endpoint,
  'spaClientId': environment.clientId,
  'login': environment.loginEndpoint
}

const configUrl = `${window.location.origin + window.location.pathname}env.json`;

export const config$: Observable<AuthOptions> = ajax.getJSON(configUrl).pipe(
  switchMap((response: AuthOptions) => of(response)),
  catchError((err) => of(authConfig)),
  shareReplay(1)
)

config$.pipe(take(1)).subscribe((authOptions: AuthOptions) => {
  environment.endpoint = authOptions.apiEndpoint;
  environment.loginEndpoint = authOptions.login;
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.error(err));
});
