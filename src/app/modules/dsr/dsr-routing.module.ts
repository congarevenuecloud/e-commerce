import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { CollaborationAuthGuard } from '../collaborative/guards/collaboration-auth.guard';

const routes: Routes = [
  {
    path: 'proposals/:quoteId',
    canActivate: [CollaborationAuthGuard],
    children: []
  },
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class DsrRoutingModule { }
