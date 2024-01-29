import { Component, OnInit, Input, ElementRef } from '@angular/core';

@Component({
  selector: 'app-detail-section',
  templateUrl: './detail-section.component.html',
  styleUrls: ['./detail-section.component.scss']
})
export class DetailSectionComponent implements OnInit {

  @Input() title: string;

  public active: boolean = false;

  constructor(public element: ElementRef) {
    element.nativeElement.classList.add('animated');
    element.nativeElement.classList.add('fadeIn');
  }

  ngOnInit() { }

}
