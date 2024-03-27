import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslatorLoaderService, CommerceModule } from '@congarevenuecloud/ecommerce';
import { TableModule, CongaModalModule, IconModule, ProductDrawerModule } from '@congarevenuecloud/elements';
import { AuthConfigModule } from './auth/auth-config.module';
import { AuthorizationGuard } from './auth/auth.guard';
import { AppRoutingModule } from './app-routing.module';
import { ComponentModule } from './components/component.module';
import { MainComponent } from './main.component';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';

// Locale data
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import localeEs from '@angular/common/locales/es';
import localeFrExtras from '@angular/common/locales/extra/fr';
import localeEsExtras from '@angular/common/locales/extra/es';
import { AuthenticationGuard } from './services/authentication.guard';

registerLocaleData(localeFr, 'fr-FR', localeFrExtras);
registerLocaleData(localeEs, 'es-MX', localeEsExtras);
@NgModule({
  declarations: [
    AppComponent,
    MainComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    CommerceModule.forRoot(environment),
    TranslateModule.forRoot({
      loader: { provide: TranslateLoader, useClass: TranslatorLoaderService }
    }),
    TableModule,
    ComponentModule,
    ProductDrawerModule,
    CongaModalModule,
    IconModule,
    AuthConfigModule
  ],
  providers: [
    AuthorizationGuard, AuthenticationGuard
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
