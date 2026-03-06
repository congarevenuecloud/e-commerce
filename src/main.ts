import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { registerLocaleData } from '@angular/common';
import localeNl from '@angular/common/locales/nl';
import localeJa from '@angular/common/locales/ja';
import localeDe from '@angular/common/locales/de';
import localeFr from '@angular/common/locales/fr';
import localeEs from '@angular/common/locales/es';
import localeIt from '@angular/common/locales/it';
import localeEnGb from '@angular/common/locales/en-GB';
import localeSv from '@angular/common/locales/sv';
import localePt from '@angular/common/locales/pt';
import localeZh from '@angular/common/locales/zh';
import { Observable, of } from 'rxjs';
import { ajax } from 'rxjs/ajax';
import { catchError, switchMap, take, shareReplay } from 'rxjs/operators';
import { AuthOptions } from '@congarevenuecloud/core';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// Register commonly used locales
registerLocaleData(localeNl, 'nl-NL');
registerLocaleData(localeJa, 'ja-JP');
registerLocaleData(localeDe, 'de-DE');
registerLocaleData(localeFr, 'fr-FR');
registerLocaleData(localeEs, 'es-ES');
registerLocaleData(localeIt, 'it-IT');
registerLocaleData(localeEnGb, 'en-GB');
registerLocaleData(localeSv, 'sv-SE');
registerLocaleData(localePt, 'pt-PT');
registerLocaleData(localeZh, 'zh-CN');

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
  environment.clientId = authOptions.spaClientId;
  environment.userId = (authOptions.guestUserId && authOptions.guestUserId !== 'null')
    ? authOptions.guestUserId
    : environment.userId;
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.error(err));
});
