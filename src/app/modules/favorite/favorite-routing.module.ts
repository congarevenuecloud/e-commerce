/**
 * Dedicated routing module for the favorite module.
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FavoriteDetailsComponent } from './layout/favorite-details/favorite-details.component';

const routes: Routes = [
  {
    path: ':id',
    component: FavoriteDetailsComponent
  },
  {
    path: '',
    redirectTo: '/my-account/favorites',
    pathMatch: 'full'
  }
];

/**
 * @internal
 */
@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class FavoriteRoutingModule { }
