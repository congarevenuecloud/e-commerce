import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthorizationGuard } from './auth/auth.guard';
import { MainComponent } from './main.component';
import { environment } from '../environments/environment';
import { AuthenticationGuard } from './services/authentication.guard';

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
            path: 'orders',
            loadChildren: () => import('./modules/order/order.module').then(m => m.OrderModule)
          },
          {
            path: 'home',
            loadChildren: () => import('./modules/home/home.module').then(m => m.HomeModule),
          },
          {
            path: 'my-account',
            loadChildren: () => import('./modules/my-account/my-account.module').then(m => m.MyAccountModule),
            data: { title: 'My Account' },
            canActivate: [AuthenticationGuard]
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
            data: { title: 'Checkout' }
          },
          {
            path: 'favorites',
            loadChildren: () => import('./modules/favorite/favorite.module').then(m => m.FavoriteModule),
            data: { title: 'Favorites'}
          },
          {
            path: '**',
            redirectTo: ''
          }
        ]
      }
    ], {
      useHash: environment.hashRouting,
      scrollPositionRestoration: 'enabled'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
