import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthorizationGuard } from './auth/auth.guard';
import { MainComponent } from './main.component';
import { environment } from '../environments/environment';
import { AuthenticationGuard } from './services/authentication.guard';
import { DsrRestrictedGuard } from './guards/dsr-restricted.guard';

@NgModule({
  imports: [
    RouterModule.forRoot([
      {
        path: '',
        canActivate: [AuthorizationGuard],
        component: MainComponent,
        children: [
          {
            path: '',
            redirectTo: 'home',
            pathMatch: 'full'
          },
          {
            path: 'dsr',
            loadChildren: () => import('./modules/dsr/dsr.module').then(m => m.DsrModule),
            data: { title: 'DSR' }
          },
          {
            path: 'orders',
            loadChildren: () => import('./modules/order/order.module').then(m => m.OrderModule),
            canActivate: [DsrRestrictedGuard]
          },
          {
            path: 'home',
            loadChildren: () => import('./modules/home/home.module').then(m => m.HomeModule),
            canActivate: [DsrRestrictedGuard]
          },
          {
            path: 'assets',
            loadChildren: () => import('./modules/assets/assets.module').then(m => m.AssetsModule),
            canActivate: [AuthenticationGuard, DsrRestrictedGuard],
          },
          {
            path: 'my-account',
            loadChildren: () => import('./modules/my-account/my-account.module').then(m => m.MyAccountModule),
            data: { title: 'My Account' },
            canActivate: [AuthenticationGuard, DsrRestrictedGuard]
          },
          {
            path: 'products',
            loadChildren: () => import('./modules/products/products.module').then(m => m.ProductsModule)
          },
          {
            path: 'carts',
            loadChildren: () => import('./modules/manage-cart/manage-cart.module').then(m => m.ManageCartModule),
            data: { title: 'Cart' }
          },
          {
            path: 'search/:query',
            loadChildren: () => import('./modules/products/products.module').then(m => m.ProductsModule),
            data: { title: 'Search' }
          },
          {
            path: 'proposals',
            loadChildren: () => import('./modules/quote/quote.module').then(m => m.QuoteModule)
          },
          {
            path: 'checkout',
            loadChildren: () => import('./modules/cart/cart.module').then(m => m.CartModule),
            data: { title: 'Checkout' },
            canActivate: [DsrRestrictedGuard]
          },
          {
            path: 'favorites',
            loadChildren: () => import('./modules/favorite/favorite.module').then(m => m.FavoriteModule),
            data: { title: 'Favorites' },
            canActivate: [DsrRestrictedGuard]
          },
          {
            path:'collaborative',
            loadChildren: () => import('./modules/collaborative/collaborative.module').then(m => m.CollaborativeModule)
          }
        ]
      },
      {
        path: '**',
        redirectTo: '',
      },
    ], {
      useHash: environment.hashRouting,
      scrollPositionRestoration: 'enabled'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
