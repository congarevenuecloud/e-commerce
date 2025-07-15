import { Component, OnInit, ChangeDetectionStrategy, Input, OnChanges } from '@angular/core';
import * as _ from 'lodash';

@Component({
  selector: 'app-progress',
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressComponent implements OnInit, OnChanges {

  @Input() steps: Array<string> = [];

  @Input() currentStep: string;

  activeIndex: number;

  ngOnInit() {
  }

  ngOnChanges() {
    this.activeIndex = _.indexOf(this.steps, this.currentStep);
  }

}
